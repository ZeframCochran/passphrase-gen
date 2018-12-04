import parseArgs from "minimist"
import { fullVersion } from "./version"
import autobind from "autobind-decorator"
const niceware = require("niceware")

@autobind
export class PassphraseTool {
  constructor(toolName, log) {
    this.toolName = toolName
    this.log = log
  }

  async ensureCommands(cmds) {
    this.cmds = this.cmds || new Set()

    const newCmds = cmds.filter((cmd) => !this.cmds.has(cmd))
    const exists = await Promise.all(newCmds.map((cmd) => commandExists(cmd)))

    newCmds.forEach((cmd) => {
      if (!!exists[cmd]) {
        throw new Error(`Command '${cmd}' does not exist.  Please install it.`)
      } else {
        this.cmds.add(cmd)
      }
    })
  }

  async getRemotes() {
    await this.ensureCommands(["git"])

    const result = await execAsync("git remote -vv")
    const output = await streamToString(result.stdout)
    const re = new RegExp(
      "^(?<name>[a-zA-Z0-9-]+)\\s+git@(?<site>bitbucket\\.org|github\\.com):(?<user>[a-zA-Z0-9-]+)/(?<slug>[a-zA-Z0-9-]+).git\\s+\\(fetch\\)$",
      "gm"
    )

    let remotes = []
    let arr = null

    while ((arr = re.exec(output)) !== null) {
      const { name, site, user, slug } = arr.groups

      remotes.push({ name, site, user, slug })
    }

    return remotes
  }

  async browse(upstream) {
    const remotes = await this.getRemotes()

    for (const remote of remotes) {
      if (
        (upstream && remote.name.match(/upstream|official|parent/)) ||
        (!upstream && remote.name === "origin")
      ) {
        const url = `https://${remote.site}/${remote.user}/${remote.slug}`

        this.log.info(`Opening ${url}...`)
        opn(url, { wait: false })
        return
      }
    }

    this.log.warning("No appropriate git remote was found")
  }

  async run(argv) {
    const options = {}

    const args = parseArgs(argv, options)

    if (args.version) {
      this.log.info(`v${fullVersion}`)
      return 0
    }

    let length = undefined
    // This is a limitation of the niceware library
    if (args._[0] && parseInt(args._[0])) {
      length = 2 * parseInt(args._[0])
      if (parseInt(args._[0]) > 512) {
        throw new Error(
          `Length '${args._[0]}' is too large, please try a smaller length`
        )
      }
    } else {
      console.log("Usage:")
      console.log("  " + this.toolName + " [length]")
      console.log("  Default length is 4, max is 512")
    }

    let passphrase = niceware.generatePassphrase(length || 8)

    console.log("Passphrase: ", passphrase)

    return 0
  }
}
