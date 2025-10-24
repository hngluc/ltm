// src/utils/authBus.js
export const notifyAuthChanged = () => {
  window.dispatchEvent(new Event('auth-changed'));
};
