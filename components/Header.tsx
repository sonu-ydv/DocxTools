import React, { useState, useEffect } from 'react';
import { useTheme } from '../hooks/useTheme';
import { SearchIcon, SunIcon, MoonIcon, MenuIcon, XIcon, FileIcon } from './icons';

const Header: React.FC = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const { theme, toggleTheme } = useTheme();

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);
    
    const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
        e.preventDefault();

        if (href === '#') {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        } else {
            const targetId = href.substring(1);
            const targetElement = document.getElementById(targetId);
            if (targetElement) {
                const headerOffset = 80; // Height of sticky header (64px) + 16px buffer
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.scrollY - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: "smooth"
                });
            }
        }

        if (isMenuOpen) {
            setIsMenuOpen(false);
        }
    };


    const navLinks = [
        { name: 'Home', href: '#' },
        { name: 'All Tools', href: '#tools' },
        { name: 'About Us', href: '#about' },
        { name: 'Contact Us', href: '#contact' },
    ];

    const Logo = () => (
        <a href="#" onClick={(e) => handleNavClick(e, '#')} className="flex items-center gap-2 text-2xl font-bold text-primary-red">
            <FileIcon className="h-7 w-7" />
            <span>DocxTools</span>
        </a>
    );

    return (
        <header className={`sticky top-0 z-50 transition-shadow duration-300 ${isScrolled ? 'shadow-md bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm' : 'bg-white dark:bg-gray-800'}`}>
            <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <Logo />
                    </div>
                    <div className="hidden md:block">
                        <div className="ml-10 flex items-center space-x-4">
                            {navLinks.map(link => (
                                <a 
                                    key={link.name} 
                                    href={link.href} 
                                    onClick={(e) => handleNavClick(e, link.href)}
                                    className="text-gray-700 dark:text-gray-300 hover:text-primary-red dark:hover:text-primary-red px-3 py-2 rounded-md text-sm font-medium"
                                >
                                    {link.name}
                                </a>
                            ))}
                        </div>
                    </div>
                    <div className="flex items-center">
                         <a href="#tools-search" onClick={(e) => handleNavClick(e, '#tools')} aria-label="Search for a tool" className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                            <SearchIcon className="h-6 w-6" />
                        </a>
                        <button 
                            onClick={toggleTheme} 
                            aria-label="Toggle theme" 
                            className="p-2 rounded-full text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-red dark:focus:ring-offset-gray-800 transition-colors"
                        >
                            {theme === 'light' 
                                ? <MoonIcon key="moon" className="h-6 w-6 fade-in" /> 
                                : <SunIcon key="sun" className="h-6 w-6 fade-in" />}
                        </button>
                        <div className="md:hidden">
                            <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Open menu" className="p-2 rounded-md text-gray-600 dark:text-gray-400">
                                {isMenuOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
                            </button>
                        </div>
                    </div>
                </div>
            </nav>

            {/* Mobile Menu */}
            <div className={`fixed top-0 left-0 w-full h-full bg-white dark:bg-gray-900 z-50 transform ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'} transition-transform duration-300 ease-in-out md:hidden`}>
                <div className="flex justify-between items-center h-16 px-4 border-b dark:border-gray-700">
                    <Logo />
                     <button onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Close menu" className="p-2 rounded-md text-gray-600 dark:text-gray-400">
                        <XIcon className="h-6 w-6" />
                    </button>
                </div>
                <div className="flex flex-col items-center justify-center h-[calc(100%-4rem)] space-y-8">
                    {navLinks.map(link => (
                        <a 
                            key={link.name} 
                            href={link.href} 
                            onClick={(e) => handleNavClick(e, link.href)}
                            className="text-gray-700 dark:text-gray-300 hover:text-primary-red text-2xl font-medium"
                        >
                            {link.name}
                        </a>
                    ))}
                </div>
            </div>
        </header>
    );
};

export default Header;