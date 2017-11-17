import * as path from "path";
import * as fs from "fs";
import * as deepmerge from "deepmerge";

export interface TsConfigLoaderResult {
  tsConfigPath: string | undefined;
  baseUrl: string | undefined;
  paths: { [key: string]: Array<string> } | undefined;
}

export interface TsConfigLoaderParams {
  getEnv: (key: string) => string | undefined;
  cwd: string;
  loadSync?(cwd: string, filename?: string): TsConfigLoaderResult;
}

export function tsConfigLoader({
  getEnv,
  cwd,
  loadSync = loadSyncDefault
}: TsConfigLoaderParams): TsConfigLoaderResult {
  const TS_NODE_PROJECT = getEnv("TS_NODE_PROJECT");

  // tsconfig.loadSync handles if TS_NODE_PROJECT is a file or directory
  const loadResult = loadSync(cwd, TS_NODE_PROJECT);
  return loadResult;
}

function loadSyncDefault(cwd: string, filename?: string): TsConfigLoaderResult {
  // Tsconfig.loadSync uses path.resolve. This is why we can use an absolute path as filename

  const configPath = resolveConfigPath(cwd, filename);

  if (!configPath) {
    return {
      tsConfigPath: undefined,
      baseUrl: undefined,
      paths: undefined
    };
  }
  const config = loadConfig(configPath);

  return {
    tsConfigPath: configPath,
    baseUrl: config && config.compilerOptions && config.compilerOptions.baseUrl,
    paths: config && config.compilerOptions && config.compilerOptions.paths
  };
}

export function resolveConfigPath(
  cwd: string,
  filename?: string
): string | undefined {
  if (filename) {
    const absolutePath = fs.lstatSync(filename).isDirectory()
      ? path.resolve(filename, "./tsconfig.json")
      : path.resolve(cwd, filename);

    return absolutePath;
  }

  return path.resolve(cwd, "./tsconfig.json");
}

export function walkForTsConfig(
  directory: string,
  existsSync: (path: string) => boolean = fs.existsSync
): string | undefined {
  const configPath = path.resolve(directory, "./tsconfig.json");
  if (existsSync(configPath)) {
    return configPath;
  }

  const parentDirectory = path.resolve(directory, "../");

  // If we reached the top
  if (directory === parentDirectory) {
    return undefined;
  }

  return walkForTsConfig(parentDirectory, existsSync);
}

function loadConfig(
  configFilePath: string
): { [key: string]: any } | undefined {
  if (!fs.existsSync(configFilePath)) {
    return undefined;
  }

  const config = require(configFilePath);

  if (config.extends) {
    const currentDir = path.dirname(configFilePath);
    const base = loadConfig(path.resolve(currentDir, config.extends)) || {};
    return deepmerge(base, config);
  }
  return config;
}
