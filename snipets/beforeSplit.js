var userId =  apim.getvariable('oauth.resource-owner') || null;

if (userId ) {
  var requestId = apim.getvariable('request.headers.x-request-id');

  if (!requestId) {
    apim.setvariable('error_code', 'FORMAT_ERROR', 'set');
    apim.setvariable('http_code', '500', 'set');
    apim.error('BG_ERROR');
  } else {
    var operationId = apim.getvariable('api.operation.id');
    if (operationId != 'createConsent') {
      var oauthConsentId = apim.getvariable('oauth.miscinfo').split(':')[1];
      var consentId = apim.getvariable('request.headers.consent-id');

      if (!consentId) {
        apim.setvariable('error_code', 'CONSENT_UNKNOWN', 'set');
        apim.setvariable('http_code', '500', 'set');
        apim.error('BG_ERROR');            }
      } else if (oauthConsentId != consentId) {
        apim.setvariable('error_code', 'CONSENT_UNKNOWN', 'set');
        apim.setvariable('http_code', '500', 'set');
        apim.error('BG_ERROR');
      }
    }
  }
}
else {
  apim.setvariable('oauth.resource-owner', "", "set")
}
