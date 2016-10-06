var treeify = require('treeify');
var bowerJson = require('bower-json');
var fs = require('fs');
var _ = require('underscore');
var npmLicense = require('npm-license');
var packageLicense = require('package-license');
var path = require('path');

exports.init = function(options, callback){
  var output = {};
  var completed = [];
    if (fs.existsSync('.bowerrc')){
        try {
          options = _.extend({}, JSON.parse(fs.readFileSync('.bowerrc')), options);
        } catch(e){}
    }
    options = _.extend({}, {directory: 'bower_components'}, options);
    // check each bower package recursively
    if (!fs.existsSync(options.directory)) {
      callback(null, new Error('No bower components found in ' + options.directory + '. Run bower install first or check your .bowerrc file'));
      return;
    }
    var packages = fs.readdirSync(options.directory);
    packages.forEach(function(package){
        bowerJson.find(path.resolve(options.directory, package), function(err, filename){
            if (!filename){
                output[package] = {licenses: 'UNKNOWN'};
                completed.push(package);
                return;
            }
            bowerJson.read(filename, function(err, bowerData){

                if (!!err) {
                    callback(null, err);
                    return;
                }

                var moduleInfo = {licenses: []};
                if (bowerData.license) moduleInfo.licenses = moduleInfo.licenses.concat(bowerData.license);
                if (bowerData.repository)moduleInfo.repository = bowerData.repository;
                if (bowerData.homepage) moduleInfo.homepage = bowerData.homepage;
                if (bowerData.description) moduleInfo.description = bowerData.description;
                
                if (typeof moduleInfo.repository === 'object' && typeof moduleInfo.repository.url === 'string') {
                      moduleInfo.repository = moduleInfo.repository.url.replace('git+ssh://git@', 'git://').replace('.git', '');
                      moduleInfo.repository = moduleInfo.repository.replace('git+https://github.com', 'https://github.com').replace('.git', '');
                      moduleInfo.repository = moduleInfo.repository.replace('git://github.com', 'https://github.com').replace('.git', '');
                      moduleInfo.repository = moduleInfo.repository.replace('git@github.com:', 'https://github.com/').replace('.git', '');
                  }
                // enhance with npm-license
                npmLicense.init({start: path.resolve(options.directory, package)}, function(npmData){
                    var npmVersion;
                    if (Object.keys(npmData).length > 0)
                        npmVersion = Object.keys(npmData)[0].split('@')[1];
                    var version = bowerData.version || npmVersion;
                    output[bowerData.name + '@' + version] = moduleInfo;

                    for (var packageName in npmData){
                        if (npmData[packageName].licenses && npmData[packageName].licenses !== 'UNKNOWN')
                            moduleInfo.licenses = moduleInfo.licenses.concat(npmData[packageName].licenses)
                        if (npmData[packageName].repository)
                            moduleInfo.repository = npmData[packageName].repository;

                    }

                    // enhance with package-license
                    var licenseFromFS = packageLicense(path.resolve(options.directory, package));
                    if (licenseFromFS) moduleInfo.licenses = moduleInfo.licenses.concat(licenseFromFS);

                    if (moduleInfo.licenses.length === 0){
                        moduleInfo.licenses = 'UNKNOWN';
                    } else {
                        // remove licenses with asterisk if the same license already exists
                        moduleInfo.licenses = _.filter(moduleInfo.licenses, function(license){
                            var iAsk =  license.indexOf ? license.indexOf('*') : -1;
                            return (
                                // return well defined licenses (without an asterisk)
                                iAsk === -1 ||
                                // remove licenses with asterisk if the same license already exists
                                _.indexOf(moduleInfo.licenses, license.substring(0, iAsk)) < 0
                            );
                        });

                        // remove duplicated licenses
                        moduleInfo.licenses = _.uniq(moduleInfo.licenses);
                    }

                    completed.push(package);
                    if (completed.length === packages.length){
                        callback(output);
                    }
                });
            });
        });
    });
}
exports.printTree = function(sorted){
    console.log(treeify.asTree(sorted, true));
}
exports.printJson = function(sorted){
    console.log(JSON.stringify(sorted, null, 2));
}

exports.printCsv = function(sorted, customFormat){
  var text = [ ], textArr = [ ], lineArr = [ ];

    if (customFormat && Object.keys(customFormat).length > 0) {
        textArr = [ ];
        textArr.push('"module name"');
        Object.keys(customFormat).forEach(function forEachCallback(item) {
            textArr.push('"' + item + '"');
        });
        text.push(textArr.join(','));
    } else {
        text.push(['"module name"','"license"','"repository"','"description"'].join(','));
    }

    Object.keys(sorted).forEach(function(key) {
        var module = sorted[key],
        line = '';
        lineArr = [ ];

        //Grab the custom keys from the custom format
        if (customFormat && Object.keys(customFormat).length > 0) {
            lineArr.push('"' + key + '"');
            Object.keys(customFormat).forEach(function forEachCallback(item) {
                lineArr.push('"' + module[item] + '"');
            });
            line = lineArr.join(',');
        } else {
                   
            line = [
                '"' + key + '"',
                '"' + (module.licenses || '') + '"',
                '"' + (module.repository || module.homepage || '') + '"',
                '"' + (module.description || '') + '"'
            ].join(',');
        }
        text.push(line);
    });

    console.log(text.join('\n'));
}
