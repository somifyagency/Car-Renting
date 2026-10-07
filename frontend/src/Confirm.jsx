import Modal from "./Modal.jsx";

export default function Confirm({ title, text, action = "Delete", danger = true, onYes, onClose }) {
  return (
    <Modal title={title} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Keep it</button><button className={`btn ${danger ? "danger" : ""}`} onClick={onYes}>{action}</button></>}>
      <p className="confirm-text">{text}</p>
    </Modal>
  );
}
