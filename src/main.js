var knox        = require("knox");
var fs          = require("fs");
var async       = require("async");
var _           = require("lodash");
var colors      = require("colors");


var client;

exports.setConfig = function(config) {
  client = knox.createClient(config);
};


exports.upload = function(dir) {
  var self = this;
  self.getFilesToDelete(dir, function (filesToDelete) {
    self.getLocalFiles(dir, function(err, results) {
      if (err) throw err;
      self.uploadFiles(dir, results, function() {
        self.deleteFiles(filesToDelete, function() {
          console.log("Finished".bold.green);
        });
      });
    });
  });
};

exports.getExistingFiles = function(cb) {
  client.list(null, function(err, data){
    var arr = _.pluck(data.Contents, "Key");
    cb(err, arr);
  });
};

// Gets all the files in a directory (recursive)
exports.getLocalFiles = function(dir, done) {

  var results = [];
  var self = this;
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    var pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = dir + "/" + file;
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          self.getLocalFiles(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
};

exports.getFilesToDelete = function (dir,  cb) {
  console.log("Getting existing files in bucket...".bold.cyan);
  var self = this;
  this.getExistingFiles(function (err, filesInBucket) {
    self.getLocalFiles(dir, function (err, localFiles) {
      var localFilesWithModifiedPath = _.map(localFiles, function(file) {
        return file.replace(dir, "").substr(1);
      });
      var filesToDelete = _.difference(filesInBucket, localFilesWithModifiedPath);
      cb(filesToDelete);
    });
  });
};


exports.uploadFiles = function(dir, files, cb) {

  var self = this;
  console.log("Uploading...".bold.cyan);
  async.eachLimit(files, 15, function (file, callback) {
    self.uploadFile(dir, file, function(result) {
      callback(null);
    });
  }, function(err) {
    if (err) {
      console.log(err.bold.red);
    } else {
      var message = "Uploaded "+files.length+" files successfully";
      console.log(message.bold.cyan);
      cb();
    }
    
  });
};

// Save a file
exports.uploadFile = function(dir, path, cb) {
  var headers = {
    "x-amz-acl": "public-read" // public
  };
  var message = "Uploading "+path;
  console.log(message.cyan);
  var destination = path.replace(dir, "");  // change destination path
  var req = client.putFile(path, destination, headers, function(err, res) {
    if (res && 200 == res.statusCode) {
      cb(["success", destination]);
    } else {
      cb("failure");
    }
  });
};

exports.deleteFiles = function(filesToDelete, cb) {
  var message = "Deleting removed files...";
  console.log(message.bold.cyan);
  client.deleteMultiple(filesToDelete, function(err, res){
    var message = "Deleted "+filesToDelete.length+" files";
    console.log(message.bold.cyan);
    cb();
  });
};
