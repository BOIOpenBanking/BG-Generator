var consentId = apim.getvariable('oauth.miscinfo').split(':')[1];

var userId = "";
if (apim.getvariable('request.authorization')) {
    userId = apim.getvariable('oauth.resource-owner');
}

var result = {
    "consentStatus": "received",
    "consentId": consentId,
    "_links":
      {
        "self": {"href": "/v1/consents/" + consentId},
        "scaStatus": {"href": "v1/consents/" + consentId + "/authorisations/" + userId},
        "scaOAuth": {"href": "https://api.eu-gb.apiconnect.appdomain.cloud/coraladarboiorgil-dev/sb/oauth-provider/oauth2/authorize"}
      }
    }

apim.output('application/json');
session.output.write(JSON.stringify(result, null, 2));
