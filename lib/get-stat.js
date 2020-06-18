import {promisify} from 'util'
import fs from 'fs'

const fstat = promisify(fs.stat)

export default async (file) => {
  const stat = await fstat(file).catch(() => false)

  if (stat && stat.isFile()) {
    return stat
  }

  return false
}
