import "../styles/Register.css";

type DataInputTypeDocProps = {
    label: string;
    options: string[];
}

export function DataInputDataList(props: DataInputTypeDocProps) {
    return (
        <>
        <div className="data-input-container">
            <label className="data-input-label">{props.label}</label>
            <input className='data-input-input' list="datalist"/>
        </div>

        <datalist id="datalist">
            {props.options.map((option, index) => (
                <option key={index} value={option} />   
            ))}
        </datalist>
        </>
    );
}