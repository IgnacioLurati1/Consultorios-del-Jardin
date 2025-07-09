import "../styles/Register.css";
export function DataInput(props: { label: string}) {
    return (
        <div className="data-input-container">
            <label className="data-input-label">{props.label}</label>
            <input className='data-input-input' type="text" required />
        </div>
    );
}