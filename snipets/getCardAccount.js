var userId = "";
if (apim.getvariable('request.authorization')) {
  userId = apim.getvariable('oauth.resource-owner');
}

apim.readInputAsJSON(function(err, bankData) {
  var result = {};
  try {
    var myAccountsInfo = bankData.allAccounts.find(item => item.id === userId);
    result = myAccountsInfo.cardAccountsData;

    if (!result) {
      result = {};
    }
  } catch (e) {
    result = e;
  }

  apim.output('application/json');
  session.output.write(JSON.stringify(result, null, 2));
});
