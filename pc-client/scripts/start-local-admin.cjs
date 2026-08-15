"use strict";

process.env.AIHUB_ADMIN_HOST ||= "127.0.0.1";
process.env.AIHUB_ADMIN_PORT ||= "4173";
process.env.AIHUB_ADMIN_PUBLIC_ORIGIN ||= "http://127.0.0.1:4173";
process.env.AIHUB_CATALOG_ASSET_ORIGIN ||= "https://localhost:4443";

require("../admin/server.cjs");
