export default function removeValue(array, value, count) {
  let source = array;
  let target = value;
  let maxCount = count;

  if (Array.isArray(this)) {
    source = this;
    target = array;
    maxCount = value;
  }

  if (!Array.isArray(source)) {
    return source;
  }

  let removed = 0;
  while (true) {
    if (typeof maxCount === 'number' && maxCount >= 0 && removed >= maxCount) {
      break;
    }
    const index = source.indexOf(target);
    if (index === -1) {
      break;
    }
    source.splice(index, 1);
    removed++;
  }

  return source;
}