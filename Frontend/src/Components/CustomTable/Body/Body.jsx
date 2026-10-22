import Table from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TableCell from "@mui/material/TableCell";
import TableBody from "@mui/material/TableBody";
import Paper from "@mui/material/Paper";
import Checkbox from "@mui/material/Checkbox";
import { TableHeadStyle4 } from "../../../lib";

const Body = ({
    headers,
    bodyData,
    isSelectOption,
    handleSelectRow,
    handleSelectAllRow,
    isChecked,
    isSelectedAll = false,
}) => {
    return (
        <TableContainer
            component={Paper}
            sx={{
                position: "relative",
                scrollbarWidth: 'thin'
            }}
        >
            <Table
                stickyHeader
                size="small"
                sx={{
                    // border: 1,
                    borderBottom: 0
                }}
            >
                <TableHead>
                    <TableRow>
                        {
                            isSelectOption &&
                            <TableCell
                                align="center"
                                sx={{
                                    ...TableHeadStyle4,
                                    position: "sticky",
                                    right: 0,
                                    borderLeft: 0
                                }}
                            >
                                <Checkbox
                                    sx={{
                                        padding: 0,
                                        color: 'white',
                                        '&.Mui-checked': {
                                            color: 'white',
                                        },
                                    }}
                                    // size="small"
                                    onClick={handleSelectAllRow || undefined}
                                    checked={isSelectedAll}
                                />
                            </TableCell>
                        }
                        {
                            headers && headers.map((header, index) => (
                                <TableCell
                                    align="center"
                                    key={header}
                                    sx={{
                                        ...TableHeadStyle4,
                                        // borderLeft: index === 0 ? (isSelectOption ? 1 : 0) : 1
                                    }}
                                >
                                    {header}
                                </TableCell>
                            ))
                        }
                    </TableRow>
                </TableHead>
                <TableBody>
                    {bodyData &&
                        Array.isArray(bodyData) &&
                        bodyData?.map((row, index) => (
                            <TableRow
                                key={index}
                                sx={{
                                    // borderBottom: '2px solid blue'
                                }}
                            >
                                {isSelectOption &&
                                    <TableCell
                                        align="center"
                                        sx={{
                                            whiteSpace: "nowrap",
                                            py: '1px',
                                            position: "sticky",
                                            right: 0,
                                            borderLeft: 0,
                                            bgcolor: row?.isError ? 'red' : 'white',
                                            // borderBottom: '1px solid black'
                                        }}
                                    >
                                        <Checkbox
                                            size="small"
                                            sx={{ padding: 0 }}
                                            onClick={() => handleSelectRow(index)}
                                            checked={isChecked(row)}
                                        />
                                    </TableCell>}
                                {
                                    headers &&
                                    headers.map((head, indx) => (
                                        <TableCell
                                            key={indx}
                                            // component="th"
                                            scope="row"
                                            align="center"
                                            sx={{
                                                whiteSpace: "nowrap",
                                                py: '1px',
                                                px: .5,
                                                fontSize: 14,
                                                // borderLeft: indx === 0 ? (isSelectOption ? 1 : 0) : 1,
                                                // borderColor: 'black'
                                                bgcolor: row?.isError ? 'red' : 'white',
                                                // borderBottom: '1px solid black'
                                            }}
                                        >
                                            {(head === 'SL No' || head === 'SL NO') ? (Number(row?.[head]) < 10 ? `00${row?.[head]}` : Number(row?.[head]) < 100 ? `0${row?.[head]}` : row?.[head]) : row?.[head]}
                                        </TableCell>))
                                }
                            </TableRow>
                        ))
                    }
                </TableBody>
            </Table>
        </TableContainer>
    )
}

export default Body;