
import "../styles/DataInput.css";

type dataInputProps ={
    label:string,
    type: string,
    options?: string[]
}

export function DataInput(props: dataInputProps) {
    
    let input = <input className='data-input-input' 
                    type={props.type} 
                />;

    if (props.type === "selector" && props.options) {

        input = <select className='data-input-selector' id={`datalist-${props.label}`}>
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