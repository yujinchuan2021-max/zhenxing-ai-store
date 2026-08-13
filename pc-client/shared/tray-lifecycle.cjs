"use strict";

function shouldHideWindowOnClose({ isQuitting, trayAvailable }) {
  return isQuitting === false && trayAvailable === true;
}

function shouldKeepAppAlive({ platform, isQuitting, trayAvailable }) {
  if (platform === "darwin") return true;
  return isQuitting === false && trayAvailable === true;
}

module.exports = {
  shouldHideWindowOnClose,
  shouldKeepAppAlive
};
