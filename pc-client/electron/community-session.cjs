"use strict";

const COMMUNITY_PARTITION = "persist:aihub-community";

async function clearCommunitySessionCookies(sessionApi) {
  await sessionApi
    .fromPartition(COMMUNITY_PARTITION)
    .clearStorageData({ storages: ["cookies"] });
}

module.exports = {
  COMMUNITY_PARTITION,
  clearCommunitySessionCookies
};
