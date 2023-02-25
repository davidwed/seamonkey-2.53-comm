/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "nsCMSSecureMessage.h"

#include <string.h>

#include "ScopedNSSTypes.h"
#include "SharedCertVerifier.h"
#include "cms.h"
#include "mozilla/Logging.h"
#include "mozilla/RefPtr.h"
#include "nsCOMPtr.h"
#include "nsDependentSubstring.h"
#include "nsIInterfaceRequestor.h"
#include "nsServiceManagerUtils.h"
#include "nsISupports.h"
#include "nsIX509Cert.h"
#include "nsIX509CertDB.h"
#include "nsNSSComponent.h"
#include "nsNSSHelper.h"
#include "plbase64.h"

extern mozilla::LazyLogModule gPIPNSSLog;

using namespace mozilla;
using namespace mozilla::psm;

// Standard ISupports implementation
// NOTE: Should these be the thread-safe versions?

/*****
 * nsCMSSecureMessage
 *****/

// Standard ISupports implementation
NS_IMPL_ISUPPORTS(nsCMSSecureMessage, nsICMSSecureMessage)

// nsCMSSecureMessage constructor
nsCMSSecureMessage::nsCMSSecureMessage()
{
  // initialize superclass
}

// nsCMSMessage destructor
nsCMSSecureMessage::~nsCMSSecureMessage()
{
}

nsresult nsCMSSecureMessage::Init()
{
  nsresult rv;
  nsCOMPtr<nsISupports> nssInitialized = do_GetService("@mozilla.org/psm;1", &rv);
  return rv;
}

nsresult nsCMSSecureMessage::CheckUsageOk(
  nsIX509Cert* aCert, SECCertificateUsage aUsage, bool* aCanBeUsed) {
  NS_ENSURE_ARG_POINTER(aCert);
  *aCanBeUsed = false;

  nsresult rv;
  nsCOMPtr<nsIX509CertDB> certdb = do_GetService(
    "@mozilla.org/security/x509certdb;1", &rv);
  NS_ENSURE_SUCCESS(rv, rv);

  RefPtr<SharedCertVerifier> certVerifier(GetDefaultCertVerifier());
  NS_ENSURE_TRUE(certVerifier, NS_ERROR_UNEXPECTED);

  UniqueCERTCertList unusedBuiltChain;
  if (certVerifier->VerifyCert(aCert->GetCert(),
                               aUsage,
                               mozilla::pkix::Now(),
                               nullptr,
                               nullptr,
                               unusedBuiltChain,
                               CertVerifier::FLAG_LOCAL_ONLY) == mozilla::pkix::Success) {
    *aCanBeUsed = true;
  }
  return NS_OK;
}

NS_IMETHODIMP nsCMSSecureMessage::CanBeUsedForEmailEncryption(nsIX509Cert* aCert, bool* aCanBeUsed) {
  return CheckUsageOk(aCert, certificateUsageEmailRecipient, aCanBeUsed);
}

NS_IMETHODIMP nsCMSSecureMessage::CanBeUsedForEmailSigning(nsIX509Cert* aCert, bool* aCanBeUsed) {
  return CheckUsageOk(aCert, certificateUsageEmailSigner, aCanBeUsed);
}

// nsCMSSecureMessage::DecodeCert
NS_IMETHODIMP nsCMSSecureMessage::
DecodeCert(const char *value, nsIX509Cert ** _retval)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::DecodeCert\n"));
  nsresult rv = NS_OK;
  int32_t length;
  unsigned char *data = 0;

  *_retval = 0;

  if (!value) { return NS_ERROR_FAILURE; }

  rv = decode(value, &data, &length);
  if (NS_FAILED(rv)) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::DecodeCert - can't decode cert\n"));
    return rv;
  }

  nsCOMPtr<nsIX509CertDB> certdb = do_GetService(NS_X509CERTDB_CONTRACTID);
  if (!certdb) {
    return NS_ERROR_FAILURE;
  }

  nsDependentCSubstring certDER(reinterpret_cast<char*>(data), length);
  nsCOMPtr<nsIX509Cert> cert;
  rv = certdb->ConstructX509(certDER, getter_AddRefs(cert));
  NS_ENSURE_SUCCESS(rv, rv);

  cert.forget(_retval);
  free((char*)data);

  return NS_OK;
}

// nsCMSSecureMessage::SendMessage
// Don't clash with Bill's versions SendMessageA or SendMessageW.
#if defined (_MSC_VER)
#undef SendMessage
#endif
NS_IMETHODIMP nsCMSSecureMessage::
SendMessage(const char *msg, const char *base64Cert, char ** _retval)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage\n"));
  nsresult rv = NS_OK;
  CERTCertificate *cert = 0;
  NSSCMSMessage *cmsMsg = 0;
  unsigned char *certDER = 0;
  int32_t derLen;
  NSSCMSEnvelopedData *env;
  NSSCMSContentInfo *cinfo;
  NSSCMSRecipientInfo *rcpt;
  SECItem output;
  PLArenaPool *arena = PORT_NewArena(1024);
  SECStatus s;
  nsCOMPtr<nsIInterfaceRequestor> ctx = new PipUIContext();

  /* Step 0. Create a CMS Message */
  cmsMsg = NSS_CMSMessage_Create(nullptr);
  if (!cmsMsg) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't create NSSCMSMessage\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  /* Step 1.  Import the certificate into NSS */
  rv = decode(base64Cert, &certDER, &derLen);
  if (NS_FAILED(rv)) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't decode / import cert into NSS\n"));
    goto done;
  }

  cert = CERT_DecodeCertFromPackage((char *)certDER, derLen);
  if (!cert) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't decode cert from package\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  /* Step 2.  Get a signature cert */

  /* Step 3. Build inner (signature) content */

  /* Step 4. Build outer (enveloped) content */
  env = NSS_CMSEnvelopedData_Create(cmsMsg, SEC_OID_DES_EDE3_CBC, 0);
  if (!env) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't create envelope data\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  cinfo = NSS_CMSEnvelopedData_GetContentInfo(env);
  s = NSS_CMSContentInfo_SetContent_Data(cmsMsg, cinfo, 0, false);
  if (s != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't set content data\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  rcpt = NSS_CMSRecipientInfo_Create(cmsMsg, cert);
  if (!rcpt) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't create recipient info\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  s = NSS_CMSEnvelopedData_AddRecipient(env, rcpt);
  if (s != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't add recipient\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  /* Step 5. Add content to message */
  cinfo = NSS_CMSMessage_GetContentInfo(cmsMsg);
  s = NSS_CMSContentInfo_SetContent_EnvelopedData(cmsMsg, cinfo, env);
  if (s != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't set content enveloped data\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  /* Step 6. Encode */
  NSSCMSEncoderContext *ecx;

  output.data = 0; output.len = 0;
  ecx = NSS_CMSEncoder_Start(cmsMsg, 0, 0, &output, arena,
            0, ctx, 0, 0, 0, 0);
  if (!ecx) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't start cms encoder\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  s = NSS_CMSEncoder_Update(ecx, msg, strlen(msg));
  if (s != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't update encoder\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  s = NSS_CMSEncoder_Finish(ecx);
  if (s != SECSuccess) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::SendMessage - can't finish encoder\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  /* Step 7. Base64 encode and return the result */
  rv = encode(output.data, output.len, _retval);

done:
  if (certDER) free((char *)certDER);
  if (cert) CERT_DestroyCertificate(cert);
  if (cmsMsg) NSS_CMSMessage_Destroy(cmsMsg);
  if (arena) PORT_FreeArena(arena, false);  /* false? */

  return rv;
}

/*
 * nsCMSSecureMessage::ReceiveMessage
 */
NS_IMETHODIMP nsCMSSecureMessage::
ReceiveMessage(const char *msg, char **_retval)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::ReceiveMessage\n"));
  nsresult rv = NS_OK;
  NSSCMSDecoderContext *dcx;
  unsigned char *der = 0;
  int32_t derLen;
  NSSCMSMessage *cmsMsg = 0;
  SECItem *content;
  nsCOMPtr<nsIInterfaceRequestor> ctx = new PipUIContext();

  /* Step 1. Decode the base64 wrapper */
  rv = decode(msg, &der, &derLen);
  if (NS_FAILED(rv)) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::ReceiveMessage - can't base64 decode\n"));
    goto done;
  }

  dcx = NSS_CMSDecoder_Start(0, 0, 0, /* pw */ 0, ctx, /* key */ 0, 0);
  if (!dcx) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::ReceiveMessage - can't start decoder\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  (void)NSS_CMSDecoder_Update(dcx, (char *)der, derLen);
  cmsMsg = NSS_CMSDecoder_Finish(dcx);
  if (!cmsMsg) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::ReceiveMessage - can't finish decoder\n"));
    rv = NS_ERROR_FAILURE;
    /* Memory leak on dcx?? */
    goto done;
  }

  content = NSS_CMSMessage_GetContent(cmsMsg);
  if (!content) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::ReceiveMessage - can't get content\n"));
    rv = NS_ERROR_FAILURE;
    goto done;
  }

  /* Copy the data */
  *_retval = (char*)malloc(content->len+1);
  memcpy(*_retval, content->data, content->len);
  (*_retval)[content->len] = 0;

done:
  if (der) free(der);
  if (cmsMsg) NSS_CMSMessage_Destroy(cmsMsg);

  return rv;
}

nsresult nsCMSSecureMessage::
encode(const unsigned char *data, int32_t dataLen, char **_retval)
{
  nsresult rv = NS_OK;

  *_retval = PL_Base64Encode((const char *)data, dataLen, nullptr);
  if (!*_retval) { rv = NS_ERROR_OUT_OF_MEMORY; goto loser; }

loser:
  return rv;
}

nsresult nsCMSSecureMessage::
decode(const char *data, unsigned char **result, int32_t * _retval)
{
  MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::decode\n"));
  nsresult rv = NS_OK;
  uint32_t len = strlen(data);
  int adjust = 0;

  /* Compute length adjustment */
  if (data[len-1] == '=') {
    adjust++;
    if (data[len-2] == '=') adjust++;
  }

  *result = (unsigned char *)PL_Base64Decode(data, len, nullptr);
  if (!*result) {
    MOZ_LOG(gPIPNSSLog, LogLevel::Debug, ("nsCMSSecureMessage::decode - error decoding base64\n"));
    rv = NS_ERROR_ILLEGAL_VALUE;
    goto loser;
  }

  *_retval = (len*3)/4 - adjust;

loser:
  return rv;
}
