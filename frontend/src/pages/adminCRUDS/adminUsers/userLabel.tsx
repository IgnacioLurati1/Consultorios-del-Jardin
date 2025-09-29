import "../CRUDSLabel.css"

interface UserLabelProps {
    user: {
        email: string;
        name: string;
        surname:string;
        active:boolean
    };
}

export function UserLabel({ user }: UserLabelProps){
    return (
        <div className={`${user.active? 'crud-label-green' : 'crud-label-red' } crud-label city-label`}>
            <p className="crud-email">{user.email}</p>
            <p className="crud-name">{user.name}</p>
            <p className="crud-name">{user.surname}</p>
        </div>
    );
}