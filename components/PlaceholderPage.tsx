export default function PlaceholderPage({
  title,
  desc,
  phase,
}: {
  title: string;
  desc: string;
  phase: string;
}) {
  return (
    <div className="container">
      <div className="page-header">
        <h1 className="page-title">{title}</h1>
        <p className="page-desc">{desc}</p>
      </div>
      <div className="card">
        <div className="section-title">翻新進度</div>
        <p style={{ fontSize: 13.5, color: "var(--text-secondary)" }}>
          此頁將於 {phase} 搬遷至 Next.js 版本，功能與資料來源不變，舊站目前仍可正常使用。
        </p>
      </div>
    </div>
  );
}
