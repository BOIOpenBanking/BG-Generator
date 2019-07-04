var error_code = apim.getvariable("error_code");
var http_code = apim.getvariable("http_code") || "500";

apim.readInputAsJSON(function(err, bankData) {
  var result = {};

  if (err) {
      result = err;
      http_code = "999";
  } else {
      result = bankData.allErrors.find(item => item.code === error_code) || {"title": "Internal Error"};
  }

  apim.setvariable('message.status.code', http_code, "set");
  //apim.setvariable('message.body', result, "set");
  //apim.setvariable('message.headers.content-type', "application/problem+json", "set");
  apim.output('application/problem+json');
  session.output.write(JSON.stringify(result, null, 2));
});
