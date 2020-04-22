import * as path from "path"
import { LensBinary, LensBinaryOpts } from "./lens-binary"

export class PrometheusCli extends LensBinary {

  public constructor(baseDir: string, version: string) {
    const opts: LensBinaryOpts = {
      version,
      baseDir: baseDir,
      originalBinaryName: "prometheus",
    }
    super(opts)
  }

  protected getTarName(): string|null {
    return `prometheus-${this.binaryVersion}.${this.platformName}-${this.arch}.tar.gz`
  }

  protected getUrl() {
    return `https://github.com/prometheus/prometheus/releases/download/v${this.binaryVersion}/prometheus-${this.binaryVersion}.${this.platformName}-${this.arch}.tar.gz`
  }

  protected getBinaryPath() {
    return path.join(this.dirname, this.binaryName)
  }

  protected getOriginalBinaryPath() {
    return path.join(this.dirname, `prometheus-${this.binaryVersion}.${this.platformName}-${this.arch}`, this.originalBinaryName)
  }
}

const prometheusVersion = require("../../package.json").config.bundledPrometheusVersion
const isDevelopment = process.env.NODE_ENV !== "production"
let baseDir: string = null

if(isDevelopment) {
  baseDir = path.join(process.cwd(), "binaries", "client")
} else {
  baseDir = path.join(process.resourcesPath)
}

export const prometheusCli = new PrometheusCli(baseDir, prometheusVersion)

