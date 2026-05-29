import { ref, computed, onUnmounted } from 'vue';

export function useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack) {
  const isDragging = ref(false);

  const onDragStart = (event) => {
    isDragging.value = true;
    updateSliderFromEvent(event);
    globalThis.addEventListener('mousemove', onDragMove);
    globalThis.addEventListener('mouseup', onDragEnd);
    globalThis.addEventListener('touchmove', onDragMove);
    globalThis.addEventListener('touchend', onDragEnd);
  };

  const onDragMove = (event) => {
    if (!isDragging.value) return;
    updateSliderFromEvent(event);
  };

  const onDragEnd = () => {
    isDragging.value = false;
    globalThis.removeEventListener('mousemove', onDragMove);
    globalThis.removeEventListener('mouseup', onDragEnd);
    globalThis.removeEventListener('touchmove', onDragMove);
    globalThis.removeEventListener('touchend', onDragEnd);
  };

  const onKeyDown = (event) => {
    const step = 1000;
    let newValue;
    
    switch(event.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        event.preventDefault();
        newValue = Math.min(maxAllowedBandwidth.value, grossBandwidth.value + step);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        event.preventDefault();
        newValue = Math.max(minGrossBandwidth.value, grossBandwidth.value - step);
        break;
      case 'Home':
        event.preventDefault();
        newValue = minGrossBandwidth.value;
        break;
      case 'End':
        event.preventDefault();
        newValue = maxAllowedBandwidth.value;
        break;
      default:
        return;
    }
    
    grossBandwidth.value = newValue;
  };

  const updateSliderFromEvent = (event) => {
    if (!sliderTrack.value) return;
    const rect = sliderTrack.value.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    
    let x = clientX - rect.left;
    if (x < 0) x = 0;
    if (x > rect.width) x = rect.width;
    
    const percentage = x / rect.width;
    const max = maxAllowedBandwidth.value;
    
    let newGross = percentage * max;
    
    grossBandwidth.value = Math.round(newGross);
  };

  onUnmounted(() => {
    globalThis.removeEventListener('mousemove', onDragMove);
    globalThis.removeEventListener('mouseup', onDragEnd);
    globalThis.removeEventListener('touchmove', onDragMove);
    globalThis.removeEventListener('touchend', onDragEnd);
  });

  const thumbStyle = computed(() => {
    const max = maxAllowedBandwidth.value;
    if (!max) return { width: '0%', left: '0%' };
    
    const overhead = overheadBandwidth.value;
    const gross = grossBandwidth.value;
    
    const widthPct = (overhead / max) * 100;
    const net = gross - overhead;
    const leftPct = (net / max) * 100;
    
    return {
      width: `${widthPct}%`,
      left: `${leftPct}%`
    };
  });

  const trackFillStyle = computed(() => {
     const max = maxAllowedBandwidth.value;
     if (!max) return { width: '0%' };
     
     const overhead = overheadBandwidth.value;
     const gross = grossBandwidth.value;
     const net = gross - overhead;
     
     const widthPct = (net / max) * 100;
     return { width: `${widthPct}%` };
  });

  const grossBadgeStyle = computed(() => {
    const max = maxAllowedBandwidth.value;
    if (!max) return { left: '0%' };
    const gross = grossBandwidth.value;
    const pct = (gross / max) * 100;
    return { left: `${pct}%` };
  });

  const netBadgeStyle = computed(() => {
    const max = maxAllowedBandwidth.value;
    if (!max) return { left: '0%' };
    const overhead = overheadBandwidth.value;
    const gross = grossBandwidth.value;
    const net = gross - overhead;
    const pct = (net / max) * 100;
    return { left: `${pct}%` };
  });

  return {
    isDragging,
    onDragStart,
    onKeyDown,
    thumbStyle,
    trackFillStyle,
    grossBadgeStyle,
    netBadgeStyle
  };
}