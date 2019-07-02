var userId = "";
if (apim.getvariable('request.authorization')) {
  userId = apim.getvariable('oauth.resource-owner');
}

apim.readInputAsJSON(function(err, bankData) {
  var result = {};
  try {
    var myAccountsInfo = bankData.allAccounts.find(item => item.id === userId);

    var withBalanceQuery = apim.getvariable('request.parameters.withBalance') || true;
    if (withBalanceQuery === "false") {
      //myAccountsInfo.accountsData.accounts.map(function(item) {
      //  delete item.bad;
      //  return item;
      //});
      myAccountsInfo.accountsData.accounts.forEach(function(item, index) {
        delete item._links;
      });
    }
    result = myAccountsInfo.accountsData;

    if (!result) {
      result = {};
    }
  } catch (e) {
    result = e;
  }

  apim.output('application/json');
  session.output.write(JSON.stringify(result, null, 2));
});
