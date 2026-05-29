import { ref } from 'vue';
import { jest } from '@jest/globals';
import { useSlider } from '../../app/composables/ui/useSlider.js';

describe('useSlider composable', () => {
  let maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack;
  let addEventListenerSpy, removeEventListenerSpy;

  beforeEach(() => {
    maxAllowedBandwidth = ref(100000);
    grossBandwidth = ref(60000);
    overheadBandwidth = ref(10000);
    minGrossBandwidth = ref(20000);
    sliderTrack = ref({
      getBoundingClientRect: () => ({ left: 100, width: 1000 })
    });

    addEventListenerSpy = jest.spyOn(globalThis, 'addEventListener').mockImplementation(() => {});
    removeEventListenerSpy = jest.spyOn(globalThis, 'removeEventListener').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('initializes correctly', () => {
    const { isDragging } = useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack);
    expect(isDragging.value).toBe(false);
  });

  it('handles styles with maxAllowedBandwidth = 0', () => {
    maxAllowedBandwidth.value = 0;
    const { thumbStyle, trackFillStyle, grossBadgeStyle, netBadgeStyle } = useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack);
    
    expect(thumbStyle.value).toEqual({ width: '0%', left: '0%' });
    expect(trackFillStyle.value).toEqual({ width: '0%' });
    expect(grossBadgeStyle.value).toEqual({ left: '0%' });
    expect(netBadgeStyle.value).toEqual({ left: '0%' });
  });

  it('calculates styles correctly', () => {
    const { thumbStyle, trackFillStyle, grossBadgeStyle, netBadgeStyle } = useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack);
    
    expect(thumbStyle.value).toEqual({ width: '10%', left: '50%' });
    expect(trackFillStyle.value).toEqual({ width: '50%' });
    expect(grossBadgeStyle.value).toEqual({ left: '60%' });
    expect(netBadgeStyle.value).toEqual({ left: '50%' });
  });

  it('starts drag', () => {
    const { onDragStart, isDragging } = useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack);
    
    onDragStart({ clientX: 200 }); // (200 - 100) / 1000 = 10% -> 10000
    
    expect(isDragging.value).toBe(true);
    expect(grossBandwidth.value).toBe(10000); 
    expect(addEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
  });

  it('handles drag move and end', () => {
    const { onDragStart } = useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack);
    
    onDragStart({ clientX: 200 }); 
    
    const mouseMoveHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'mousemove')[1];
    const mouseUpHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'mouseup')[1];
    
    mouseMoveHandler({ clientX: 600 }); // (600 - 100) / 1000 = 50% -> 50000
    expect(grossBandwidth.value).toBe(50000);

    // Bounds handling left
    mouseMoveHandler({ clientX: 0 }); // out of bounds left
    expect(grossBandwidth.value).toBe(0); 

    // Bounds handling right
    mouseMoveHandler({ touches: [{ clientX: 1200 }] }); // out of bounds right with touch
    expect(grossBandwidth.value).toBe(100000); // clamped to max
    
    mouseUpHandler();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
  });

  it('handles keydown logic correctly', () => {
    const { onKeyDown } = useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, sliderTrack);
    
    const triggerKey = (key) => onKeyDown({ key, preventDefault: jest.fn() });
    
    grossBandwidth.value = 50000;
    triggerKey('ArrowRight');
    expect(grossBandwidth.value).toBe(51000);
    
    triggerKey('ArrowUp');
    expect(grossBandwidth.value).toBe(52000);

    triggerKey('ArrowLeft');
    expect(grossBandwidth.value).toBe(51000);

    triggerKey('ArrowDown');
    expect(grossBandwidth.value).toBe(50000);

    triggerKey('Home');
    expect(grossBandwidth.value).toBe(20000);

    triggerKey('End');
    expect(grossBandwidth.value).toBe(100000);

    grossBandwidth.value = 50000;
    triggerKey('UnknownKey');
    expect(grossBandwidth.value).toBe(50000); // no change
  });
  
  it('does nothing on update if sliderTrack is missing', () => {
    const { onDragStart } = useSlider(maxAllowedBandwidth, grossBandwidth, overheadBandwidth, minGrossBandwidth, ref(null));
    grossBandwidth.value = 50000;
    onDragStart({ clientX: 200 }); // Should early return
    expect(grossBandwidth.value).toBe(50000);
  });
});
