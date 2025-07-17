import "../styles/DataInput.css";

type dataInputProps ={
    label:string,
    type: string,
    options?: string[]
    value?: string,
    onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void
}

export function DataInput(props: dataInputProps) {
    
    let input = <input 
                    type={props.type} 
                    className="data-input-input"
                    value={props.value}
                    onChange={props.onChange}
                />;

    if (props.type === "selector" && props.options) {

        input =  <select className='data-input-selector' 
                id={`datalist-${props.label}`}
                value={props.value}
                onChange={props.onChange}>
                    <option value="" disabled>Seleccionar...</option>
                    {props.options.map((option, index) => (
                        <option key={index} value={option}>{option}</option>   
                    ))}
                </select>
        }
                
    return (

        
        <div className="data-input-container">
            
            <label className="data-input-label">{props.label}</label>
            {input}
        
        </div>
    );

    

}