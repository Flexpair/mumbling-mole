export function getOSName () {
  if (typeof window !== 'undefined') {
    return 'Browser'
  } else {
    return 'Node.js'
  }
}

export function getOSVersion () {
  if (typeof window !== 'undefined') {
    return navigator.userAgent
  } else {
    return process.version
  }
}
