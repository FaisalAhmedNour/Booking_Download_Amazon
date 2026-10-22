import React, { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FactoryOutlinedIcon from '@mui/icons-material/FactoryOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';

import VendorDetails from './VendorDetails/VendorDetails';
import CompanyCodeDetails from './CompanyCodeDetails/CompanyCodeDetails';

const SettingsMenu = ({ onSettingsChange }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const [openVendorModal, setOpenVendorModal] = useState(false);
    const [openCompanyModal, setOpenCompanyModal] = useState(false);

    const isMenuOpen = Boolean(anchorEl);

    const handleMenuOpen = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    return (
        <>
            <Tooltip title="Reference Settings" arrow placement="left" disableInteractive>
                <Paper
                    sx={{
                        width: 40,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        '&:hover': {
                            bgcolor: '#f5f5f5'
                        }
                    }}
                    onClick={handleMenuOpen}
                >
                    <IconButton size="small" color="primary">
                        <SettingsOutlinedIcon sx={{ color: '#555' }} />
                    </IconButton>
                </Paper>
            </Tooltip>

            <Menu
                anchorEl={anchorEl}
                open={isMenuOpen}
                onClose={handleMenuClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
                PaperProps={{
                    sx: {
                        minWidth: 220,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        mt: 0.5
                    }
                }}
            >
                <MenuItem
                    onClick={() => {
                        handleMenuClose();
                        setOpenVendorModal(true);
                    }}
                    sx={{ gap: 1.5, py: 1, fontSize: 13 }}
                >
                    <FactoryOutlinedIcon fontSize="small" color="primary" />
                    <span>Vendor / Factory Details</span>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        handleMenuClose();
                        setOpenCompanyModal(true);
                    }}
                    sx={{ gap: 1.5, py: 1, fontSize: 13 }}
                >
                    <BusinessOutlinedIcon fontSize="small" color="primary" />
                    <span>Company Code Details</span>
                </MenuItem>
            </Menu>

            {/* Modals */}
            <VendorDetails
                open={openVendorModal}
                onClose={() => setOpenVendorModal(false)}
                onDataChange={onSettingsChange}
            />
            <CompanyCodeDetails
                open={openCompanyModal}
                onClose={() => setOpenCompanyModal(false)}
                onDataChange={onSettingsChange}
            />
        </>
    );
};

export default SettingsMenu;
