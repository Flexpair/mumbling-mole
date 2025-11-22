
import { ref, reactive, toRef, isRef, isReactive } from './__mocks__/vue.js';

console.log('Testing mocks...');

const r = ref(10);
console.log('ref(10):', r);
console.log('isRef(r):', isRef(r));

const obj = reactive({ count: ref(0), name: 'test' });
console.log('reactive obj:', obj);
console.log('isReactive(obj):', isReactive(obj));
console.log('obj.count (unwrapped):', obj.count);

const countRef = toRef(obj, 'count');
console.log('toRef(obj, "count"):', countRef);
console.log('isRef(countRef):', isRef(countRef));
console.log('countRef.value:', countRef.value);

obj.count = 5;
console.log('After obj.count = 5, countRef.value:', countRef.value);

countRef.value = 10;
console.log('After countRef.value = 10, obj.count:', obj.count);

const nameRef = toRef(obj, 'name');
console.log('toRef(obj, "name"):', nameRef);
console.log('nameRef.value:', nameRef.value);

console.log('Done.');
