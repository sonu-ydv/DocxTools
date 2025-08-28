
import React from 'react';

const Footer: React.FC = () => {
    return (
        <footer id="contact" className="bg-gray-800 dark:bg-black text-gray-300">
            <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">About DocxTools</h3>
                        <p className="mt-4 text-base text-gray-300">
                            Providing free and secure document processing tools that work directly in your browser. No uploads required.
                        </p>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Tools</h3>
                        <ul className="mt-4 space-y-4">
                            <li><a href="#tools" className="text-base text-gray-300 hover:text-white">Merge PDF</a></li>
                            <li><a href="#tools" className="text-base text-gray-300 hover:text-white">Split PDF</a></li>
                            <li><a href="#tools" className="text-base text-gray-300 hover:text-white">Compress PDF</a></li>
                            <li><a href="#tools" className="text-base text-gray-300 hover:text-white">Convert PDF</a></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Company</h3>
                        <ul className="mt-4 space-y-4">
                            <li><a href="#about" className="text-base text-gray-300 hover:text-white">About</a></li>
                            <li><a href="#" className="text-base text-gray-300 hover:text-white">Privacy Policy</a></li>
                            <li><a href="#" className="text-base text-gray-300 hover:text-white">Terms of Service</a></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Contact</h3>
                        <ul className="mt-4 space-y-4">
                            <li><a href="mailto:support@docxtools.com" className="text-base text-gray-300 hover:text-white">support@docxtools.com</a></li>
                        </ul>
                    </div>
                </div>
                <div className="mt-8 border-t border-gray-700 pt-8 text-center">
                    <p className="text-base text-gray-400">&copy; 2024 DocxTools. All Rights Reserved.</p>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
