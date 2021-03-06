var app = require('app');
var fs = require('fs');
var path = require('path');
var exec = require('exec');
var autoUpdater = require('auto-updater');
var BrowserWindow = require('browser-window');
var ipc = require('ipc');
var argv = require('minimist')(process.argv);

var size = {
  width: 1000,
  height: 700
};

try {
  var sizeFile = JSON.parse(fs.readFileSync(path.join(process.env[(process.platform === 'win32') ? 'USERPROFILE' : 'HOME'], 'Library', 'Application\ Support', 'Kitematic', 'size')));
  size = sizeFile;
} catch (err) {}

var settingsjson;
try {
  settingsjson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'settings.json'), 'utf8'));
} catch (err) {
  settingsjson = {};
}

process.env.NODE_PATH = __dirname + '/../node_modules';
process.env.RESOURCES_PATH = __dirname + '/../resources';
process.chdir(path.join(__dirname, '..'));
process.env.PATH = '/usr/local/bin:' + process.env.PATH;

var mainWindow = null;
var windowOptions = {
  width: size.width,
  height: size.height,
  'min-width': 1000,
  'min-height': 700,
  resizable: true,
  frame: false,
  show: true
};

app.on('activate-with-no-open-windows', function () {
  if (mainWindow) {
    mainWindow.show();
  }
  return false;
});

app.on('ready', function() {
  mainWindow = new BrowserWindow(windowOptions);
  var closeVMOnQuit = false;
  if (argv.test) {
    mainWindow.loadUrl(path.normalize('file://' + path.join(__dirname, '..', 'build/tests.html')));
  } else {
    mainWindow.loadUrl(path.normalize('file://' + path.join(__dirname, '..', 'build/index.html')));
    app.on('will-quit', function () {
      if (closeVMOnQuit) {
        exec('/usr/bin/VBoxManage controlvm dev poweroff', function () {});
      }
    });
  }

  mainWindow.webContents.on('new-window', function (e) {
    e.preventDefault();
  });

  mainWindow.webContents.on('will-navigate', function (e, url) {
    if (url.indexOf('build/index.html#/containers') < 0) {
      e.preventDefault();
    }
  });

  mainWindow.webContents.on('did-finish-load', function() {
    mainWindow.setTitle('');
    mainWindow.show();
    mainWindow.focus();

    // Auto Updates
    if (process.env.NODE_ENV !== 'development' && !argv.test) {
      autoUpdater.setFeedUrl('https://updates.kitematic.com/releases/latest?version=' + app.getVersion() + '&beta=' + !!settingsjson.beta);

      autoUpdater.on('checking-for-update', function () {
        console.log('Checking for update...');
      });

      autoUpdater.on('update-available', function (e) {
        console.log('Update available.');
        console.log(e);
      });

      autoUpdater.on('update-not-available', function () {
        console.log('Update not available.');
      });

      autoUpdater.on('update-downloaded', function (e, releaseNotes, releaseName, releaseDate, updateURL) {
        console.log(e, releaseNotes, releaseName, releaseDate, updateURL);
        console.log('Update downloaded.');
        console.log(releaseNotes, releaseName, releaseDate, updateURL);
        mainWindow.webContents.send('notify', 'application:update-available');
      });

      autoUpdater.on('error', function (e, error) {
        console.log('An error occured while checking for updates.');
        console.log(error);
      });

      ipc.on('command', function (event, arg) {
        console.log('Command: ' + arg);
        if (arg === 'application:quit-install') {
          closeVMOnQuit = false;
          autoUpdater.quitAndInstall();
        }
      });
    }

    ipc.on('vm', function (event, arg) {
      closeVMOnQuit = arg;
    });
  });
});
