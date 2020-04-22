import { app } from "electron"
import { spawn, ChildProcess } from "child_process"
import * as tcpPortUsed from "tcp-port-used"
import * as fs from "fs"
import * as hb from "handlebars"
import * as url from "url"
import * as path from "path"
import logger from "./logger"
import { Cluster } from "./cluster"
import { prometheusCli } from "./prometheus-cli"
import { ensureDir, randomFileName } from "./file-helpers"

export class PrometheusService {
  public lastError: string

  protected cluster: Cluster
  protected configDir = app.getPath("temp")
  protected dataPath = path.join(app.getPath("temp"), "data")
  protected env: NodeJS.ProcessEnv = null
  protected prometheusProcess: ChildProcess
  protected port: number
  protected confFile: string
  protected retentionTime = "2h"
  protected retentionSize = "100MB"
  protected blockDuration = "2h"

  constructor(cluster: Cluster, port: number, env: NodeJS.ProcessEnv) {
    this.env = env
    this.port = port
    this.cluster = cluster
    this.confFile = this.createTemporaryConfig()
  }

  public async run(): Promise<void> {
    if (this.prometheusProcess) {
      return Promise.resolve()
    }

    const prometheusBin = await prometheusCli.binaryPath()

    const clusterUrl = url.parse(this.cluster.apiUrl)
    let args = [
      "--web.listen-address", `127.0.0.1:${this.port}`,
      "--config.file", this.confFile,
      "--storage.tsdb.path", this.dataPath,
      "--storage.tsdb.retention.time", this.retentionTime,
      "--storage.tsdb.retention.size", this.retentionSize,
      "--storage.tsdb.min-block-duration", this.blockDuration,
      "--storage.tsdb.max-block-duration", this.blockDuration,
    ]
    logger.debug('starting prometheus')
    this.prometheusProcess = spawn(prometheusBin, args, {
      env: this.env
    })
    this.prometheusProcess.on("exit", (code) => {
      logger.error(`proxy ${this.cluster.contextName} exited with code ${code}`)

      this.prometheusProcess = null
    })
    this.prometheusProcess.stdout.on('data', (data) => {
      logger.debug('PROMETHEUS STDOUT: ' + data.toString())
    })
    this.prometheusProcess.stderr.on('data', (data) => {
      logger.warn('PROMETHEUS STDERR: ' + data.toString())
    })

    return tcpPortUsed.waitUntilUsed(this.port, 500, 10000)
  }

  public exit() {
    if (this.prometheusProcess) {
      logger.debug(`Stopping local prometheus: ${this.cluster.contextName}`)
      this.prometheusProcess.kill()

      logger.debug('Deleting temporary prometheus.yaml: ' + this.confFile)
      fs.unlinkSync(this.confFile)
    }
  }

  protected createTemporaryConfig(): string {
    ensureDir(this.configDir)
    const tmpPath = `${this.configDir}/${randomFileName("prometheus.yaml")}`
    const templatePath = path.join(__dirname, 'prometheus.yaml.hb')
    const apiUrl = this.cluster.contextHandler.kc.getCurrentCluster().server
    logger.debug('apiUrl:' + apiUrl)
    const templateConfig = {
      apiUrl: apiUrl
    }
    logger.debug('Creating temporary prometheus.yaml: ' + templatePath)
    const rawTemplate = fs.readFileSync(templatePath).toString()
    const template = hb.compile(rawTemplate);
    fs.writeFileSync(tmpPath, template(templateConfig))
    return tmpPath
  }
}
