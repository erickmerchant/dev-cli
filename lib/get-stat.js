import fs from 'fs'
import {promisify} from 'util'

const fstat = promisify(fs.stat)

export const getStat = async (file) => {
  const stat = await fstat(file).catch(() => false)

  if (stat && stat.isFile()) {
    return stat
  }

  return false
}
