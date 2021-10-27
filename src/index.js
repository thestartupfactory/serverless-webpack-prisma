'use strict';
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');
const glob = require('fast-glob');

class ServerlessWebpackPrisma {
  engines = [
    'node_modules/.prisma/client/libquery_engine*',
    '!node_modules/.prisma/client/libquery_engine-rhel*',

    'node_modules/prisma/libquery_engine*',
    '!node_modules/prisma/libquery_engine-rhel*',

    'node_modules/@prisma/engines/libquery_engine*',
    '!node_modules/@prisma/engines/libquery_engine-rhel*',

    'node_modules/@prisma/engines/migration-engine*',
    '!node_modules/@prisma/engines/migration-engine-rhel*',

    'node_modules/@prisma/engines/prisma-fmt*',
    '!node_modules/@prisma/engines/prisma-fmt-rhel*',

    'node_modules/@prisma/engines/introspection-engine*',
    '!node_modules/@prisma/engines/introsㅁpection-engine-rhel*',
  ];

  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options;
    this.commands = {};
    this.hooks = {
      'after:webpack:package:packExternalModules':
        this.onBeforeWebpackPackage.bind(this),
    };
  }

  onBeforeWebpackPackage() {
    const { servicePath } = this.serverless.config;
    for (const functionName of this.getFunctions()) {
      const cwd = path.join(servicePath, '.webpack', functionName);
      this.serverless.cli.log(`Generate prisma client for ${functionName}...`);
      childProcess.execSync('prisma generate', { cwd });
      const unusedEngines = glob.sync(this.engines, { cwd });
      if (unusedEngines.length <= 0) continue;
      this.serverless.cli.log(`Remove unused prisma engine: `);
      unusedEngines.forEach((engine) => {
        this.serverless.cli.log(`- ${engine}`);
        const enginePath = path.join(cwd, engine);
        fs.rmSync(enginePath, { force: true });
      });
    }
  }

  // Ref: https://github.com/serverless-heaven/serverless-webpack/blob/4785eb5e5520c0ce909b8270e5338ef49fab678e/lib/utils.js#L115)
  getFunctions() {
    const functions = this.serverless.service.getAllFunctions();

    return functions.filter((funcName) => {
      const func = this.serverless.service.getFunction(funcName);

      // if `uri` is provided or simple remote image path, it means the
      // image isn't built by Serverless so we shouldn't take care of it
      if (
        (func.image && func.image.uri) ||
        (func.image && typeof func.image == 'string')
      ) {
        return false;
      }

      return this.isNodeRuntime(
        func.runtime || this.serverless.service.provider.runtime || 'nodejs'
      );
    });
  }

  isNodeRuntime(runtime) {
    return runtime.match(/node/);
  }
}

module.exports = ServerlessWebpackPrisma;