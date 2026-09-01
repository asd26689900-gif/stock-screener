export default function Footer() {
  return (
    <footer className="footer">
      <div className="schedule">
        <span className="chip gold">自動更新時程</span>
        <span>08:30 新聞</span>
        <span>15:30 行情・焦點</span>
        <span>17:30 法人</span>
        <span>19:00 處置預警・重大資訊</span>
        <span>22:00 資券</span>
        <span>週六 06:30 集保大戶</span>
      </div>
      <p className="disc">
        本站僅整理公開資訊，不構成投資建議，亦非投顧服務。資料來源：TWSE / TPEX / 公開資訊觀測站 / Yahoo Finance / FinMind。
      </p>
    </footer>
  );
}
