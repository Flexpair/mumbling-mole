// Browser-only implementation (Node.js support removed)
export function getOSName () {
  return 'Browser'
}

export function getOSVersion () {
  return navigator.userAgent
}
