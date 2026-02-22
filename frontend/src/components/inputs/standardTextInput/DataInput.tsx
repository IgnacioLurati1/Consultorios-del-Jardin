import "./DataInput.css";

type dataInputProps ={
    label:string,
    type: string,
    options?: string[]
    value?: string,
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void,
    disabled?: boolean,
}

export function DataInput(props: dataInputProps) {
    const inputId = `input-${props.label.replace(/\s+/g, '-').toLowerCase()}`;
    
    let input = <input 
                    type={props.type} 
                    className="data-input-input"
                    value={props.value}
                    onChange={props.onChange}
                    disabled={props.disabled}
                    id={inputId}
                />;
                
    return (

        <div className="data-input-container"> 
            <label htmlFor={inputId} className="data-input-label">{props.label}</label>
            {input}
        </div>

    );
}