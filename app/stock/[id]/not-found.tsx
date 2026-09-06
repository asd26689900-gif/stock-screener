import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container">
      <div className="notfound">
        <div className="notfound-code">查無此股</div>
        <p className="notfound-msg">
          找不到這檔股票的盤後資料。可能是代號輸入錯誤，或該股票尚未收錄。
          你可以用上方的查股框重新輸入代號或名稱。
        </p>
        <div className="notfound-actions">
          <Link href="/" className="btn primary">回首頁</Link>
          <Link href="/modules" className="btn">看選股模組</Link>
        </div>
      </div>
    </div>
  );
}
