#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const workflowPath = path.join(root, 'workflows', 'tassimo-price-tracker.json');
const nodeSources = new Map([
  ['Product List', path.join(root, 'src', 'product-list.js')],
  ['Parse & Compare', path.join(root, 'src', 'parse-and-compare.js')],
]);

function findNode(workflow, nodeName) {
  const node = workflow.nodes.find(candidate => candidate.name === nodeName);
  if (!node) {
    throw new Error(`Workflow node "${nodeName}" was not found in ${path.relative(root, workflowPath)}.`);
  }
  return node;
}

function validateCode(code, filePath) {
  try {
    new Function(code);
  } catch (error) {
    throw new Error(`Syntax error in ${path.relative(root, filePath)}: ${error.message}`);
  }
}

function readWorkflow() {
  try {
    return JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  } catch (error) {
    throw new Error(`Could not read workflow JSON: ${error.message}`);
  }
}

function build() {
  const workflow = readWorkflow();
  for (const [nodeName, sourcePath] of nodeSources) {
    const code = fs.readFileSync(sourcePath, 'utf8');
    validateCode(code, sourcePath);
    const node = findNode(workflow, nodeName);
    node.parameters.mode = 'runOnceForAllItems';
    node.parameters.jsCode = code;
  }

  delete workflow.staticData;
  delete workflow.pinData;
  fs.writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
}

function extract() {
  const workflow = readWorkflow();
  for (const [nodeName, sourcePath] of nodeSources) {
    const code = findNode(workflow, nodeName).parameters.jsCode;
    if (typeof code !== 'string') {
      throw new Error(`Workflow node "${nodeName}" does not contain a string jsCode value.`);
    }
    validateCode(code, workflowPath);
    fs.writeFileSync(sourcePath, `${code.trimEnd()}\n`);
  }
}

function check() {
  const workflow = readWorkflow();
  for (const [nodeName, sourcePath] of nodeSources) {
    const code = fs.readFileSync(sourcePath, 'utf8');
    validateCode(code, sourcePath);
    const workflowCode = findNode(workflow, nodeName).parameters.jsCode;
    if (workflowCode !== code) {
      throw new Error(`Workflow code for "${nodeName}" differs from ${path.relative(root, sourcePath)}; run node scripts/sync.js build.`);
    }
  }
}

function main() {
  const command = process.argv[2] || 'build';
  if (!['build', 'extract', 'check'].includes(command)) {
    throw new Error('Usage: node scripts/sync.js [build|extract|check]');
  }
  ({ build, extract, check })[command]();
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
