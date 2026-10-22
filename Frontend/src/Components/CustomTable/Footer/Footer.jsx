const Footer = ({ footerButtons }) => {
    return (
        <div className="flex items-center justify-center gap-2 py-1">
            {footerButtons &&
                Array.isArray(footerButtons) &&
                footerButtons?.map((footerButton, index) => (
                    <span key={footerButton.id || index}>{footerButton}</span>
                ))
            }
        </div>
    )
}

export default Footer;