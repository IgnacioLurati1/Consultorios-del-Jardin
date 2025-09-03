interface DurationLabelProps{
    duration:{
        idDuration: string,
        time:string,
        active:boolean
    }
};

export function DurationLabel({ duration }: DurationLabelProps){
    return (
        <div className={`${duration.active? 'crud-label-green' : 'crud-label-red'} crud-label`}>
            <p className="crud-id">ID: {duration.idDuration}</p>
            <p className="crud-name">{duration.time}</p>
        </div>
    );
}
