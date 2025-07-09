import "../styles/Register.css";

type dataInputProps ={
    label:string,
    type: string,
    options?: string[]
}

export function DataInput(props: dataInputProps) {
    return (

        <>
        <div className="data-input-container">
            <label className="data-input-label">{props.label}</label>
            <input className='data-input-input' 
            type={props.type} 
            list={props.options ? `datalist-${props.label}` : undefined} />
        </div>

        {props.type === "datalist" && props.options &&(
            <datalist id={`datalist-${props.label}`}>
            {props.options.map((option, index) => (
                <option key={index} value={option} />   
            ))}
            </datalist>
        )
        }
        </>
    );

    

}