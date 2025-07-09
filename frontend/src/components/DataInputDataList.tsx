import "../styles/Register.css";

type DataInputDataListProps = {
    label: string;
    options: string[];
}

export function DataInputDataList(props: DataInputDataListProps) {
    return (
        <>
        <div className="data-input-container">
            <label className="data-input-label">{props.label}</label>
            <input className='data-input-input' list={`datalist-${props.label}`}/>
        </div>

        <datalist id={`datalist-${props.label}`}>
            {props.options.map((option, index) => (
                <option key={index} value={option} />   
            ))}
        </datalist>
        </>
    );
}