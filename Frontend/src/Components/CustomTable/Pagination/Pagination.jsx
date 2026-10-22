import { IconButton, Menu, MenuItem } from "@mui/material";
import KeyboardArrowLeftIcon from '@mui/icons-material/KeyboardArrowLeft';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { useState } from "react";

const Pagination = ({
    className,
    leftButtons,
    rightButtons,
    page,
    rowsPerPage,
    totalRows,
    isSelected,
    onChangePage,
    onChangeRowsPerPage,
    rowsPerPageOptions,
    needPagination = true
}) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const open = Boolean(anchorEl);
    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleChangeRowsPerPage = (v) => {
        onChangeRowsPerPage(v);
        handleClose();
    }

    return (
        <div className="relative overflow-hidden w-full">
            <div className={`flex justify-between items-center py-1 ${className}`}>
                <div className="flex items-center gap-1 ms-1">{
                    leftButtons &&
                        Array.isArray(leftButtons) ?
                        leftButtons.map((leftButton, index) => <span key={index}>{leftButton}</span>) :
                        leftButtons
                }</div>
                <div className="flex items-center gap-1">
                    {
                        rightButtons &&
                            Array.isArray(rightButtons) ?
                            rightButtons.map(rightButton => rightButton) :
                            rightButtons
                    }
                    {needPagination &&
                        <div className="flex items-center gap-2">
                            <span className="font-mono ms-5"><span className="cursor-pointer" onClick={handleClick}>{page * rowsPerPage}-{Math.min(page * rowsPerPage + rowsPerPage, totalRows)}</span> of {totalRows}</span>
                            <IconButton
                                size="small"
                                sx={{ p: 0 }}
                                onClick={() => onChangePage(page - 1)}
                                disabled={page === 0 ? true : false}
                            >
                                <KeyboardArrowLeftIcon />
                            </IconButton>
                            <IconButton
                                size="small"
                                sx={{ p: 0 }}
                                onClick={() => onChangePage(page + 1)}
                                disabled={page * rowsPerPage + rowsPerPage >= totalRows}
                            >
                                <KeyboardArrowRightIcon />
                            </IconButton>
                        </div>}
                </div>
            </div>
            <div className={`bg-blue-400 absolute ${isSelected ? 'top-0' : 'top-[100%]'} left-0 right-0 h-full`}>

            </div>
            {rowsPerPageOptions && <Menu
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                MenuListProps={{
                    'aria-labelledby': 'basic-button',
                }}
            >
                {
                    rowsPerPageOptions?.map(option => (
                        <MenuItem
                            sx={{
                                py: 0,
                                display: 'flex',
                                justifyContent: 'right',
                                gap: 1
                            }}
                            key={option}
                            onClick={() => handleChangeRowsPerPage(option)}
                        ><span className="font-semibold">{option}</span> rows per page</MenuItem>
                    ))
                }
            </Menu>}
        </div>
    )
}

export default Pagination;