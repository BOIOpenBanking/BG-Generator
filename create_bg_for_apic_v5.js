const yaml = require('js-yaml');
const path = require('path');
const fs = require('fs');
const converter = require('api-spec-converter');
const exec = require('child_process');
//const { exec } = require('child_process');
//const execSync = require('child_process').execSync;
const inquirer = require('inquirer')

var configFile  = process.argv[2] || './config.json';
var config = require(configFile);

var inFile  = config.inFile;
var outFile = config.outFile;
var jsonStoreURL = config.jsonStoreURL;
var gatewayBaseURL = config.gatewayBaseURL;
var outPath = config.outPath || "";
var snipetsPath = config.snipetsPath || "";
var apicVersion = config.apicVersion || "5";
var gatewayType = config.gatewayType || "datapower-gateway";
var securityRequired = config.securityRequired || "true";
var oauthScopes = config.oauthScopes || {};
var allowedScopes = config.allowedScopes || [];
var apicMgmtServer = config.apicMgmtServer || null;
var apicAlias = config.apicAlias || "apic";
var devPortal = config.devPortal || null;

var apicOrganization = new URL(gatewayBaseURL).pathname.split('/')[1]
var apicCatalog = new URL(gatewayBaseURL).pathname.split('/')[2]

if (!inFile || !outFile || !jsonStoreURL || !gatewayBaseURL) {
  console.log('\nMissing arguments in config.json:');
  console.log('- inFile: Full path to source OpenAPI v3 file');
  console.log('- outFile: File name for generated swagger v2 file');
  console.log('- jsonStoreURL: HTTP URL for data store file');
  console.log('- gatewayBaseURL - API Gateway base URL');
  console.log('- outPath (Optional) - Folder where for out files (Default - current path)');
  console.log('- snipetsPath (Optional) - Path where code snipets exist (Default - current path)');
  console.log('- apicVersion (Optional) - API Connect version (Default - 5)');
  console.log('- gatewayType (Optional) - API Gateway: datapower-gateway or datapower-api-gateway (Default - datapower-gateway)');
  console.log('- securityRequired (Optional) - Is security required (Default - true)');
  console.log('- oauthScopes (Optional) - List of OAuth scopes available (Default - no scopes)');
  console.log('- allowedScopes (Optional) -  List of OAuth scopes enabed for the API (Default - no scopes)');
  console.log('- apicMgmtServer (Optional) - Management server uRL for pubish, If not available skip publish (Default - null)');
  console.log('- apicAlias (Optional) - API Connect CLI alias (Default - apic)');
  console.log('\nExample:');
  console.log('{');
  console.log('  "inFile": "psd2-api-1.3.3-20190412.yaml",');
  console.log('  "outFile": "psd2-api-1.3.3-20190412-converted.yaml",');
  console.log('  "jsonStoreURL": "https://raw.githubusercontent.com/YanivYuzis/JsonStore/master/bankData.json",');
  console.log('  "gatewayBaseURL": "https://api.eu-gb.apiconnect.appdomain.cloud/coraladarboiorgil-dev/sb",');
  console.log('  "outPath": "./out",');
  console.log('  "snipetsPath": "./snipets/",');
  console.log('  "apicVersion": "5",');
  console.log('  "gatewayType": "datapower-gateway",');
  console.log('  "securityRequired": "true",');
  console.log('  "oauthScopes": {');
  console.log('      "view_accounts": "View Accounts"');
  console.log('  },');
  console.log('  "allowedScopes": [');
  console.log('      "view_accounts"');
  console.log('  ],');
  console.log('  "apicMgmtServer": "apimanager.eu-gb.apiconnect.cloud.ibm.com",');
  console.log('  "apicAlias": "apic"');
  console.log('}');
  console.log('\nConfig file can be local or as argument:');
  console.log('node ' + path.basename(__filename));
  console.log('node ' + path.basename(__filename) + ' ./config.json');
  console.log('\nNote:');
  console.log('Code snipets can be used only for operations with "operationId" field');

  process.exit();
}

// Delete old generated files
console.log("Delete old generated files...");
fs.mkdirSync(outPath, { recursive: true });
var files = fs.readdirSync(outPath);
for (i in files) {
  console.log(files[i]);
  fs.unlinkSync(path.join(outPath, files[i]));
}

try {
  converter.convert({
    from: 'openapi_3',
    to: 'swagger_2',
    source: inFile,
  }, function(err, converted) {
    var  options = {
      syntax: 'yaml'
    }

    //var doc = yaml.safeLoad(fs.readFileSync(inFile, 'utf8'));
    var doc = yaml.safeLoad(converted.stringify(options));

    var docVersion = doc['info']['version'];
    doc['info']['version'] = docVersion.toLowerCase().replace(/ /g, '-');

    var docTitle = doc['info']['title'];
    doc['info']['x-ibm-name'] = docTitle.toLowerCase().replace(/ /g, '-');

    doc['host'] = '$(catalog.host)';

    // Replace all oneOf definitions with object
    console.log('Replace all oneOf definitions with object...');
    Object.keys(doc.paths).forEach(function(path) {
      Object.keys(doc['paths'][path]).forEach(function(op) {
        // Replace all oneOf occurence in requests with object
        if (doc['paths'][path][op]['parameters']) {
          Object.keys(doc['paths'][path][op]['parameters']).forEach(function(parameter) {
            if (doc['paths'][path][op]['parameters'][parameter]['schema']) {
              if (doc['paths'][path][op]['parameters'][parameter]['schema']['oneOf']) {
                delete doc['paths'][path][op]['parameters'][parameter]['schema']['oneOf'];
                doc['paths'][path][op]['parameters'][parameter]['schema']['type'] = 'object';
              }
            }
          })
        }

        // Replace all header definitions in response
        Object.keys(doc['paths'][path][op]['responses']).forEach(function(code) {
          if (doc['paths'][path][op]['responses'][code]['headers']) {
            Object.keys(doc['paths'][path][op]['responses'][code]['headers']).forEach(function(header) {
              delete doc['paths'][path][op]['responses'][code]['headers'][header]['required'];
              if (doc['paths'][path][op]['responses'][code]['headers'][header]['example']){
                delete doc['paths'][path][op]['responses'][code]['headers'][header]['example'];
              }
            })
          }

          // Replace all oneOf occurence in response with object
          if (doc['paths'][path][op]['responses'][code]['schema']) {
            if (doc['paths'][path][op]['responses'][code]['schema']['oneOf']) {
              delete doc['paths'][path][op]['responses'][code]['schema']['oneOf'];
              doc['paths'][path][op]['responses'][code]['schema']['type'] = 'object';
            }
          }
        });
      })
    });

    // Replace all oneOf occurence in definitions with object
    Object.keys(doc['definitions']).forEach(function(def) {
      if (doc['definitions'][def]['properties']) {
        Object.keys(doc['definitions'][def]['properties']).forEach(function(prop) {
          if (doc['definitions'][def]['properties'][prop]['oneOf']) {
            delete doc['definitions'][def]['properties'][prop]['oneOf'];
            doc['definitions'][def]['properties'][prop]['type'] = 'object';
          }
        })
      }
    });

    // Delete all security definition in the api
    console.log('Delete all security definition in the api...');
    Object.keys(doc.paths).forEach(function(path) {
      Object.keys(doc['paths'][path]).forEach(function(op) {
        // Remove security definitions in operation level
        if (doc['paths'][path][op]['security']) {
          delete doc['paths'][path][op]['security'];
        }
      });
    });

    if (doc['securityDefinitions']) {
      delete doc['securityDefinitions'];
    }
    if (doc['security']) {
      delete doc['security'];
    }

    if (securityRequired === "true") {
      // Add security optionssfor the api
      console.log('Add security options for the api...');
      var securityDefinitions = {
        "BearerAuthOAuth": {
          "type": "oauth2",
          "description": "",
          "flow": "implicit",
          "scopes": oauthScopes,
          "authorizationUrl": config.gatewayBaseURL + '/oauth-provider/oauth2/authorize',
          "x-tokenIntrospect": {
            "url": ""
          }
        }
      }
      doc['securityDefinitions'] = securityDefinitions;

      // Add security reuired for the api
      console.log('Add security reuired for the api...');
      var security = [
        {
          "BearerAuthOAuth": allowedScopes
        }
      ]
      doc['security'] = security;
    }

    // Genarte starter code snippet for use in assembly block
    console.log('Genarte starter code snippet for use in assembly block...');
    var beforeSplitCodeSnipet = "console.log('Before operation split');";

    var beforeSplitFileData;
    if (fs.existsSync(snipetsPath + 'beforeSplit.js')) {
      beforeSplitFileData = fs.readFileSync(snipetsPath + 'beforeSplit.js', 'utf8');
    }
    if (beforeSplitFileData) {
      beforeSplitCodeSnipet = beforeSplitCodeSnipet + "\n\n" + beforeSplitFileData;
    }

    // Append assembly block to the api
    console.log('Append assembly block to the api...');
    var ibmExtension = {
      "testable": true,
      "enforced": true,
      "cors": {
        "enabled": true
      },
      "application-authentication": {
        "certificate": false
      },
      "assembly": {
        "execute": [
          {
            "gatewayscript": {
              "title": "gatewayscript",
              "version": "1.0.0",
              "source": beforeSplitCodeSnipet
            }
          },
          {
            "invoke": {
              "title": "invoke",
              "timeout": 60,
              "verb": "GET",
              "cache-response": "protocol",
              "cache-ttl": 900,
              "stop-on-error": [],
              "version": "1.0.0",
              "target-url": jsonStoreURL
            }
          },
          {
            "operation-switch": {
              "title": "operation-switch",
              "case": [],
              "otherwise": [],
              "version": "1.0.0"
            }
          },
          {
            "map": {
              "title": "map",
              "version": "1.0.0",
              "inputs": {
                "X-Request-ID": {
                  "schema": {
                    "type": "string"
                  },
                  "variable": "request.headers.x-request-id"
                }
              },
              "outputs": {
                "X-Request-ID": {
                  "schema": {
                    "type": "string"
                  },
                  "variable": "message.headers.x-request-id"
                }
              },
              "actions": [
                {
                  "set": "X-Request-ID",
                  "from": "X-Request-ID"
                }
              ]
            }
          }
        ]
      },
      "phase": "realized",
      "gateway": gatewayType
    }
    doc['x-ibm-configuration'] = ibmExtension;

    // Append operation code snippets to the api
    console.log('Append operation code snippets to the api...');
    Object.keys(doc.paths).forEach(function(path) {
      Object.keys(doc['paths'][path]).forEach(function(op) {
        var operationId = doc['paths'][path][op]['operationId'];
        if (!operationId) {
          operationId = {
            "verb": op,
            "path": path
          }
        }

        var operationCodeSnipet = "console.log('In " + operationId + "');";

        //fs.readFile(snipetsPath + operationId + '.js', function (err, operationFileData) {
        var operationFileData;
        if (fs.existsSync(snipetsPath + operationId + '.js')) {
          operationFileData = fs.readFileSync(snipetsPath + operationId + '.js', 'utf8');
        }

        if (operationFileData) {
          operationCodeSnipet = operationCodeSnipet + "\n\n" + operationFileData;
        }
        else {
          operationCodeSnipet = operationCodeSnipet + "\nsession.output.write({});";
          operationCodeSnipet = operationCodeSnipet + "\napim.output('application/json');";
        }

        var caseItem = {
          "operations": [
            operationId
          ],
          "execute": [
            {
              "gatewayscript": {
                "title": "gatewayscript",
                "version": "1.0.0",
                "source": operationCodeSnipet
              }
            },
          ]
        }
        doc['x-ibm-configuration']['assembly']['execute'][2]['operation-switch']['case'].push(caseItem);
        //});
      })
    });

    // Flush updated yaml file
    console.log('Flush updated yaml file...');
    fs.writeFileSync(outPath + outFile, yaml.safeDump(doc), 'utf8', err => {
      if (err) console.log(err);
    })

    // Update gateway URLs in yaml's snippets
    console.log("Update gateway URLs in yaml's snippets...");
    if (securityRequired === "true") {
      var data;
      data = fs.readFileSync(snipetsPath + "oauth-utils_1.0.0.yaml", 'utf8');
      fs.writeFileSync(outPath + "oauth-utils_1.0.0.yaml", data.replace(/https:\/\/api.eu-gb.apiconnect.appdomain.cloud\/coraladarboiorgil-dev\/sb/g, gatewayBaseURL), 'utf8');
      data = fs.readFileSync(snipetsPath + "oauth-provider_1.0.0.yaml", 'utf8');
      fs.writeFileSync(outPath + "oauth-provider_1.0.0.yaml", data.replace(/https:\/\/api.eu-gb.apiconnect.appdomain.cloud\/coraladarboiorgil-dev\/sb/g, gatewayBaseURL), 'utf8');
    }

    if (apicVersion === "5") {
      if (securityRequired === "true") {
        console.log("Create bg-product yaml...");
        exec.execSync(`${apicAlias} create --type product --title "BG Product" --name bg-product --filename ${outPath}bg-product_1.0.0.yaml --apis "${outFile} oauth-provider_1.0.0.yaml"`, {stdio: 'inherit'});

        console.log("Create utils-product yaml...");
        exec.execSync(`${apicAlias} create --type product --title "Utils Product" --name utils-product --filename ${outPath}utils-product_1.0.0.yaml --apis "oauth-utils_1.0.0.yaml"`, {stdio: 'inherit'});
      }
      else {
        console.log("Create bg-product yaml...");
        exec.execSync(`${apicAlias} create --type product --title "BG Product" --name bg-product --filename ${outPath}bg-product_1.0.0.yaml --apis "${outFile}"`, {stdio: 'inherit'});
      }
    }
    else if (apicVersion === "2018") {
      console.log("Create bg-product yaml...");
      exec.execSync(`${apicAlias} create:product --title "BG Product" --name bg-product --filename ${outPath}bg-product_1.0.0.yaml --apis "${outFile}"`, {stdio: 'inherit'});
      fs.appendFileSync(outPath + "bg-product_1.0.0.yaml", "\n");
      fs.appendFileSync(outPath + "bg-product_1.0.0.yaml", "gateways:\n");
      fs.appendFileSync(outPath + "bg-product_1.0.0.yaml", "  - datapower-gateway\n");

      if (securityRequired === "true") {
        console.log("Create utils-product yaml...");
        exec.execSync(`${apicAlias} create:product --title "Utils Product" --name utils-product --filename ${outPath}utils-product_1.0.0.yaml --apis "oauth-utils_1.0.0.yaml"`, {stdio: 'inherit'});
        fs.appendFileSync(outPath + "utils-product_1.0.0.yaml", "\n");
        fs.appendFileSync(outPath + "utils-product_1.0.0.yaml", "gateways:\n");
        fs.appendFileSync(outPath + "utils-product_1.0.0.yaml", "  - datapower-gateway\n");
      }
    }

    if (apicMgmtServer) {
      // Start deploy wizard
      console.log('Start deploy wizard...');
      var questions = [
        {
          type: 'confirm',
          default: true,
          name: 'confirmMgmtServer',
          message: "Confirm that server is " + apicMgmtServer,
        },
        {
          type: 'input',
          name: 'apicUser',
          message: "Username (skip if sso needed)",
          validate: function(value) {
            if (!value.length) {
              if (apicVersion === "2018") {
                console.error('\n  SSO not available for APIC v2018');

                return false;
              }
              else if (apicVersion === "5") {
                console.log('\n  Passcode required, Generate a passcode from:');
                console.log('  - apimanager.eu-gb.apiconnect.cloud.ibm.com: https://login.eu-gb.bluemix.net/UAALoginServerWAR/passcode');
                console.log('  - us.apiconnect.ibmcloud.com: https://login.ng.bluemix.net/UAALoginServerWAR/passcode');
                console.log('  - apimanager.au-syd.apiconnect.cloud.ibm.com: https://login.au-syd.bluemix.net/UAALoginServerWAR/passcode');
                console.log('  - apimanager.eu-de.apiconnect.cloud.ibm.com: https://login.eu-de.bluemix.net/UAALoginServerWAR/passcode');
                console.log('  Depends on your cloud location');
                //exec.execSync(`${apicAlias} login --server ${apicMgmtServer} --sso`, {stdio: 'inherit'});

                result = null;
                return true;
              }
            }
            else {
              return true;
            }
          },
        },
        {
          type: 'password',
          mask: '*',
          name: 'apicPassword',
          message: "Password / SSO Password (typing will be hidden)",
        }
      ]

      inquirer.prompt(questions).then(answers => {
        console.log("Logout old cli session...");
        //try { exec.execSync(`${apicAlias} logout --server ${apicMgmtServer}`, {stdio: 'inherit'}); } catch (ex) {}

        try {
          if (apicVersion === "5") {
            console.log("Set cli connection string...");
            exec.execSync(`${apicAlias} config:set catalog=apic-catalog://${apicMgmtServer}/orgs/${apicOrganization}/catalogs/${apicCatalog}`, {stdio: 'inherit'});

            if (answers['apicUser'].length > 0) {
              console.log("Login v5 cli without sso...");
              exec.execSync(`${apicAlias} login --server ${apicMgmtServer} --username ${answers['apicUser']} --password ${answers['apicPassword']}`, {stdio: 'inherit'});
            }
            else {
              console.log("Login v5 cli with sso...");
              exec.execSync(`${apicAlias} login --server ${apicMgmtServer} --sso --passcode ${answers['apicPassword']}`, {stdio: 'inherit'});
            }

            console.log("Clear old deployments and drafts...");
            //try { exec.execSync(`${apicAlias} products:clear --confirm ${apicCatalog}`, {stdio: 'inherit'}); } catch (ex) {}
            // keep bg-product in order to keep subscription
            try { exec.execSync(`${apicAlias} products:delete utils-product:1.0.0`, {stdio: 'inherit'}); } catch (ex) {}
            try { exec.execSync(`${apicAlias} drafts:delete --type product --server ${apicMgmtServer} --organization ${apicOrganization} bg-product:1.0.0`, {stdio: 'inherit'}); } catch (ex) {}
            try { exec.execSync(`${apicAlias} drafts:delete --type product --server ${apicMgmtServer} --organization ${apicOrganization} utils-product:1.0.0`, {stdio: 'inherit'}); } catch (ex) {}

            console.log("Publish bg-product...");
            exec.execSync(`${apicAlias} drafts:push ${outPath}bg-product_1.0.0.yaml --server ${apicMgmtServer} --organization ${apicOrganization}`, {stdio: 'inherit'});
            //exec.execSync(`${apicAlias} publish ${outPath}bg-product_1.0.0.yaml`, {stdio: 'inherit'});
            exec.execSync(`${apicAlias} drafts:publish bg-product:1.0.0`, {stdio: 'inherit'});

            if (securityRequired === "true") {
              console.log("Publish utils-product...");
              exec.execSync(`${apicAlias} drafts:push ${outPath}utils-product_1.0.0.yaml --server ${apicMgmtServer} --organization ${apicOrganization}`, {stdio: 'inherit'});
              //exec.execSync(`${apicAlias} publish ${outPath}utils-product_1.0.0.yaml`, {stdio: 'inherit'});
              exec.execSync(`${apicAlias} drafts:publish utils-product:1.0.0`, {stdio: 'inherit'});
            }
          }
          else if (apicVersion === "2018") {
            console.log("Set cli connection string...");
            exec.execSync(`${apicAlias} config:set org=https://${apicMgmtServer}/api/orgs/${apicOrganization}`, {stdio: 'inherit'});
            exec.execSync(`${apicAlias} config:set catalog=https://${apicMgmtServer}/api/catalogs/${apicOrganization}/${apicCatalog}`, {stdio: 'inherit'});

            console.log("Login v2018 cli...");
            exec.execSync(`${apicAlias} login --server ${apicMgmtServer} --username ${answers['apicUser']} --password ${answers['apicPassword']} --realm provider/default-idp-2`, {stdio: 'inherit'});

            console.log("Clear old deployments and drafts...");
            //try { exec.execSync(`${apicAlias} products:clear-all --scope catalog --confirm ${apicCatalog}`, {stdio: 'inherit'}); } catch (ex) {}
            //try { exec.execSync(`${apicAlias} drafts:clear --confirm ${apicOrganization}`, {stdio: 'inherit'}); } catch (ex) {}
            //try { exec.execSync(`${apicAlias} draft-products:clear-all --confirm ${apicOrganization}`, {stdio: 'inherit'}); } catch (ex) {}
            //try { exec.execSync(`${apicAlias} draft-apis:clear-all --confirm ${apicOrganization}`, {stdio: 'inherit'}); } catch (ex) {}
            // keep bg-product in order to keep subscription
            try { exec.execSync(`${apicAlias} products:clear --scope catalog utils-product --confirm ${apicCatalog}`, {stdio: 'inherit'}); } catch (ex) {}
            try { exec.execSync(`${apicAlias} draft-products:delete bg-product:1.0.0`, {stdio: 'inherit'}); } catch (ex) {}
            try { exec.execSync(`${apicAlias} draft-products:delete utils-product:1.0.0`, {stdio: 'inherit'}); } catch (ex) {}

            console.log("Publish bg-product...");
            exec.execSync(`${apicAlias} draft-products:create ${outPath}bg-product_1.0.0.yaml`, {stdio: 'inherit'});
            exec.execSync(`${apicAlias} products:publish ${outPath}bg-product_1.0.0.yaml`, {stdio: 'inherit'});

            if (securityRequired === "true") {
              console.log("Publish utils-product...");
              exec.execSync(`${apicAlias} draft-products:create ${outPath}utils-product_1.0.0.yaml`, {stdio: 'inherit'});
              exec.execSync(`${apicAlias} products:publish ${outPath}utils-product_1.0.0.yaml`, {stdio: 'inherit'});
            }
          }
          if (securityRequired === "true") {
            console.log('\n');
            console.log('Register & Subscribe application');
            console.log('Redirect URL mock: ' + gatewayBaseURL + '/oauth-utils/redirect-url');
            console.log('Demo app URL: ' + gatewayBaseURL + '/oauth-utils/onboard-login');
          }

          console.log('\n');
          if (securityRequired === "true") {
            console.log('Post consent URL: ' + gatewayBaseURL + '/psd2/v1/consents');
          }
          console.log('Get accounts URL: ' + gatewayBaseURL + '/psd2/v1/accounts');

          if (devPortal) {
            console.log('\n');
            console.log('Developer portal  URL: ' + devPortal);
          }
        } catch (ex) {
          process.exit();
        }
      });
    }
  })
} catch (e) {
  console.log(e);
}
