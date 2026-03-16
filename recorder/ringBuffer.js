class RingBuffer {
  constructor(maxLength) {
    this.maxLength = maxLength;
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    if (this.items.length > this.maxLength) {
      this.items.shift();
    }
  }

  getFrames() {
    return this.items.slice();
  }

  clear() {
    this.items = [];
  }
}

module.exports = {
  RingBuffer
};