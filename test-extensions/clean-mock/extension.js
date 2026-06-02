// Mock clean extension for testing AuditExt
// This extension follows all best practices
'use strict';

const vscode = require('vscode');

function activate(context) {
  const disposable = vscode.commands.registerCommand('mock.cleanCommand', () => {
    vscode.window.showInformationMessage('Clean extension activated!');
  });

  context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate
};
