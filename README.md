# 沙田區中學 · 資料與地圖

靜態網頁：列出沙田區中學公開資料、Leaflet / OpenStreetMap 地圖標記，以及點擊地圖量測直線距離（Haversine）。

## 本機預覽

無需建置、無需地圖 API 金鑰。任選一種靜態伺服器即可：

```bash
# Python
python3 -m http.server 8080

# 或 Node
npx --yes serve -l 8080
```

然後開啟 <http://localhost:8080>。

> 請勿直接用 `file://` 開啟：瀏覽器會阻擋對 `data/schools.json` 的 fetch。

## 功能

1. **學校資料**：45 所沙田區中學（教育局／中學概覽公開名單），含中文校名、類型、地址、電話、網址；並附民間參考組別（附免責聲明）。
2. **升中項目**：顯示 Notion「沙田升中事件清單」內容（開放日、資訊日、報名／放榜等），資料來自同步快照 `data/events.json`。
3. **地圖**：Leaflet + OSM 圖磚標示各校位置與標籤。
4. **距離工具**：在地圖上點選一點，依直線距離由近至遠列出所有學校；選點以紅色圖釘標示。

## Notion 升中項目如何運作

瀏覽器端靜態站**無法**直接呼叫 Notion API（需整合金鑰／OAuth）。因此：

1. 以 Notion MCP 讀取資料庫 `5b4d2cb03f38489484117b425a383f1e`（檢視「按日期」）。
2. 匯出為 `data/events.json` 內嵌於 repo。
3. 「升中項目」分頁載入該 JSON 並以卡片列表顯示（可按狀態篩選）。

更新 Notion 後需重新匯出並提交 `data/events.json`。

## 資料與授權

- 學校聯絡／地址：教育局分區學校名單、中學學位分配辦法沙田區公開手冊等。
- 升中事件：Notion「沙田升中事件清單」（同步快照）；請以學校／教育局官網核實。
- 座標：OpenStreetMap / Photon（鄰里層級）；個別地址以公開校址微調。
- 地圖圖磚：© OpenStreetMap contributors。
- 「民間參考組別」非官方評級，僅供參考。
