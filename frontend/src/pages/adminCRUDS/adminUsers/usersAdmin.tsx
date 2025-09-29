import { getAllUsers } from "./usersService";

export function UsersAdmin(){
    getAllUsers()
    .then(res => console.log(res))
    return (<></>);
}