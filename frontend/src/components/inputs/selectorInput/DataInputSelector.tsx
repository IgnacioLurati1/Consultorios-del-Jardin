import "../standardTextInput/DataInput.css";

type dataInputProps ={
    label:string,
    type: string,
    options: string[]
    value?: string,
    onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

export function DataInputSelector(props: dataInputProps) {
    const inputId = `datalist-${props.label.replace(/\s+/g, '-').toLowerCase()}`;

        let input =  <select className='data-input-selector' 
                id={inputId}
                value={props.value}
                onChange={props.onChange}>
                    <option value="" disabled>Seleccionar...</option>
                    {props.options.map((option, index) => (
                        <option key={index} value={option}>{option}</option>   
                    ))}
                </select>

    return (

        <div className="data-input-container">      
            <label htmlFor={inputId} className="data-input-label">{props.label}</label>
            {input}  
        </div>
        
    );
}